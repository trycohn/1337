/**
 * 🏆 ACHIEVEMENT REWARDS SERVICE
 * Сервис начисления наград за достижения в турнирах
 * @version 1.0.0
 */

const pool = require('../../db');
const TournamentStatsRepository = require('../../repositories/tournament/TournamentStatsRepository');

class AchievementRewardsService {
    /**
     * 🎁 Начисление наград за турнир (при финализации)
     * @param {number} tournamentId 
     */
    async awardTournamentAchievements(tournamentId) {
        console.log(`🎁 [AchievementRewards] Начисление наград за турнир ${tournamentId}`);

        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Получаем все достижения турнира
            const achievementsQuery = `
                SELECT 
                    ta.*,
                    u.username
                FROM tournament_achievements ta
                LEFT JOIN users u ON ta.user_id = u.id
                WHERE ta.tournament_id = $1
                ORDER BY ta.achievement_type, ta.rank;
            `;

            const achievementsResult = await client.query(achievementsQuery, [tournamentId]);
            const achievements = achievementsResult.rows;

            if (achievements.length === 0) {
                console.log(`⚠️ [AchievementRewards] Нет достижений для турнира ${tournamentId}`);
                await client.query('ROLLBACK');
                return { success: false, message: 'No achievements found' };
            }

            console.log(`📊 [AchievementRewards] Найдено ${achievements.length} достижений`);

            let totalCoinsAwarded = 0;
            let achievementsAwarded = 0;

            // Начисляем награды за каждое достижение
            for (const achievement of achievements) {
                const { user_id, achievement_type, rank, value, username } = achievement;

                // Получаем конфигурацию наград
                const rewardConfig = await this._getRewardConfig(client, achievement_type);
                
                if (!rewardConfig) {
                    console.log(`⚠️ [AchievementRewards] Нет конфигурации наград для ${achievement_type}`);
                    continue;
                }

                // Определяем количество монет по рангу
                let coinsToAward = 0;
                if (rank === 1) coinsToAward = rewardConfig.rank_1_reward;
                else if (rank === 2) coinsToAward = rewardConfig.rank_2_reward;
                else if (rank === 3) coinsToAward = rewardConfig.rank_3_reward;

                if (coinsToAward === 0) {
                    console.log(`⚠️ [AchievementRewards] Нет награды для ранга ${rank} в ${achievement_type}`);
                    continue;
                }

                // Создаем запись о достижении
                await client.query(`
                    INSERT INTO user_tournament_achievements (
                        user_id, tournament_id, achievement_type, rank, value, coins_awarded
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (tournament_id, user_id, achievement_type) DO NOTHING
                `, [user_id, tournamentId, achievement_type, rank, value, coinsToAward]);

                // Начисляем Leet Coins
                await this._awardCoins(
                    client,
                    user_id,
                    coinsToAward,
                    'tournament_achievement',
                    tournamentId,
                    `${achievement_type} - Rank ${rank}`
                );

                totalCoinsAwarded += coinsToAward;
                achievementsAwarded++;

                console.log(`💰 [AchievementRewards] ${username} (ID: ${user_id}): ${achievement_type} rank ${rank} → ${coinsToAward} coins`);
            }

            // Обновляем глобальный лидерборд для всех участников
            const uniqueUsers = [...new Set(achievements.map(a => a.user_id))];
            
            for (const userId of uniqueUsers) {
                await this._updateGlobalLeaderboard(client, userId);
            }

            await client.query('COMMIT');

            console.log(`✅ [AchievementRewards] Награды начислены: ${achievementsAwarded} достижений, ${totalCoinsAwarded} Leet Coins`);

            return {
                success: true,
                achievementsAwarded,
                totalCoinsAwarded,
                playersRewarded: uniqueUsers.length
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [AchievementRewards] Ошибка начисления наград:`, error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * 💰 Начисление Leet Coins
     * @private
     */
    async _awardCoins(client, userId, amount, source, referenceId, description) {
        // Обновляем баланс
        await client.query(`
            INSERT INTO user_coins (user_id, balance, lifetime_earned)
            VALUES ($1, $2, $2)
            ON CONFLICT (user_id) DO UPDATE SET
                balance = user_coins.balance + EXCLUDED.balance,
                lifetime_earned = user_coins.lifetime_earned + EXCLUDED.lifetime_earned
        `, [userId, amount]);

        // Записываем транзакцию
        await client.query(`
            INSERT INTO coin_transactions (user_id, amount, transaction_type, source, reference_id, description)
            VALUES ($1, $2, 'earn', $3, $4, $5)
        `, [userId, amount, source, referenceId, description]);
    }

    /**
     * 🔍 Получение конфигурации наград
     * @private
     */
    async _getRewardConfig(client, achievementType) {
        const result = await client.query(
            'SELECT * FROM achievement_rewards_config WHERE achievement_type = $1 AND is_active = TRUE',
            [achievementType]
        );
        return result.rows[0];
    }

    /**
     * 📊 Обновление глобального лидерборда
     * @private
     */
    async _updateGlobalLeaderboard(client, userId) {
        // Подсчитываем медали
        const medalsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE achievement_type = 'mvp') as mvp_count,
                COUNT(*) FILTER (WHERE rank = 1) as gold,
                COUNT(*) FILTER (WHERE rank = 2) as silver,
                COUNT(*) FILTER (WHERE rank = 3) as bronze
            FROM user_tournament_achievements
            WHERE user_id = $1
        `;

        const medalsResult = await client.query(medalsQuery, [userId]);
        const medals = medalsResult.rows[0];

        // Агрегируем статистику
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT tournament_id) as tournaments_played,
                SUM(total_kills) as total_kills,
                AVG(kd_ratio) as avg_kd,
                AVG(avg_adr) as avg_adr,
                AVG(hs_percentage) as avg_hs,
                MAX(kd_ratio) as best_kd,
                MAX(avg_adr) as best_adr,
                MAX(hs_percentage) as best_hs
            FROM tournament_player_stats
            WHERE user_id = $1
        `;

        const statsResult = await client.query(statsQuery, [userId]);
        const stats = statsResult.rows[0];

        // Рассчитываем глобальный MVP score
        const mvpScore = (parseInt(medals.mvp_count || 0) * 100) +
                        (parseInt(medals.gold || 0) * 10) +
                        (parseInt(medals.silver || 0) * 5) +
                        (parseInt(medals.bronze || 0) * 2);

        // Обновляем запись в глобальном лидерборде
        await client.query(`
            INSERT INTO global_mvp_leaderboard (
                user_id,
                total_mvp_count, gold_medals, silver_medals, bronze_medals,
                tournaments_played, total_kills,
                avg_kd_ratio, avg_adr, avg_hs_percentage,
                best_kd, best_adr, best_hs_percentage,
                global_mvp_score,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                total_mvp_count = EXCLUDED.total_mvp_count,
                gold_medals = EXCLUDED.gold_medals,
                silver_medals = EXCLUDED.silver_medals,
                bronze_medals = EXCLUDED.bronze_medals,
                tournaments_played = EXCLUDED.tournaments_played,
                total_kills = EXCLUDED.total_kills,
                avg_kd_ratio = EXCLUDED.avg_kd_ratio,
                avg_adr = EXCLUDED.avg_adr,
                avg_hs_percentage = EXCLUDED.avg_hs_percentage,
                best_kd = EXCLUDED.best_kd,
                best_adr = EXCLUDED.best_adr,
                best_hs_percentage = EXCLUDED.best_hs_percentage,
                global_mvp_score = EXCLUDED.global_mvp_score,
                updated_at = NOW()
        `, [
            userId,
            medals.mvp_count || 0,
            medals.gold || 0,
            medals.silver || 0,
            medals.bronze || 0,
            stats.tournaments_played || 0,
            stats.total_kills || 0,
            stats.avg_kd || 0,
            stats.avg_adr || 0,
            stats.avg_hs || 0,
            stats.best_kd || 0,
            stats.best_adr || 0,
            stats.best_hs || 0,
            mvpScore
        ]);

        console.log(`📊 [AchievementRewards] Глобальный лидерборд обновлен для пользователя ${userId}: ${mvpScore} баллов`);
    }

    /**
     * 🌍 Получение глобального лидерборда MVP
     * @param {number} limit - Количество результатов
     * @param {string} sortBy - Поле сортировки
     */
    async getGlobalLeaderboard(limit = 50, sortBy = 'global_mvp_score') {
        const validSortFields = ['global_mvp_score', 'total_mvp_count', 'gold_medals', 'tournaments_played'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'global_mvp_score';

        const query = `
            SELECT 
                gml.*,
                u.username,
                u.avatar_url,
                ROW_NUMBER() OVER (ORDER BY gml.${sortField} DESC) as global_rank
            FROM global_mvp_leaderboard gml
            LEFT JOIN users u ON gml.user_id = u.id
            WHERE gml.tournaments_played > 0
            ORDER BY gml.${sortField} DESC
            LIMIT $1;
        `;

        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * 👤 Получение достижений конкретного игрока
     * @param {number} userId 
     */
    async getUserAchievements(userId) {
        const query = `
            SELECT 
                uta.*,
                t.name as tournament_name,
                t.game,
                t.completed_at
            FROM user_tournament_achievements uta
            LEFT JOIN tournaments t ON uta.tournament_id = t.id
            WHERE uta.user_id = $1
            ORDER BY uta.awarded_at DESC;
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * 📊 Получение позиции игрока в глобальном лидерборде
     * @param {number} userId 
     */
    async getUserGlobalRank(userId) {
        const query = `
            WITH ranked AS (
                SELECT 
                    user_id,
                    ROW_NUMBER() OVER (ORDER BY global_mvp_score DESC) as rank
                FROM global_mvp_leaderboard
                WHERE tournaments_played > 0
            )
            SELECT rank
            FROM ranked
            WHERE user_id = $1;
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0]?.rank || null;
    }
}

module.exports = new AchievementRewardsService();

