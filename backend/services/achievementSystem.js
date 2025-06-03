// Achievement System для варианта 4
// Система достижений и геймификации

const pool = require('../db');

class AchievementSystem {
    constructor() {
        this.achievements = new Map();
        this.userProgress = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            await this.setupAchievements();
            console.log('🏆 Система достижений инициализирована');
            this.initialized = true;
        } catch (error) {
            console.error('❌ Ошибка инициализации системы достижений:', error);
        }
    }

    async setupAchievements() {
        // Создаем таблицу достижений если не существует
        await pool.query(`
            CREATE TABLE IF NOT EXISTS achievements (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                icon VARCHAR(50),
                category VARCHAR(50),
                rarity VARCHAR(20) DEFAULT 'common',
                points INTEGER DEFAULT 10,
                requirements JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создаем таблицу прогресса пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
                progress INTEGER DEFAULT 0,
                max_progress INTEGER DEFAULT 1,
                unlocked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, achievement_id)
            )
        `);

        // Инициализируем базовые достижения
        await this.initializeBaseAchievements();
    }

    async initializeBaseAchievements() {
        const baseAchievements = [
            // Турнирные достижения
            {
                key: 'first_tournament',
                name: 'Первый турнир',
                description: 'Участие в первом турнире',
                icon: '🎯',
                category: 'tournaments',
                rarity: 'common',
                points: 10,
                requirements: { type: 'tournament_participation', count: 1 }
            },
            {
                key: 'first_victory',
                name: 'Первая победа',
                description: 'Победа в первом турнире',
                icon: '🏆',
                category: 'tournaments',
                rarity: 'uncommon',
                points: 25,
                requirements: { type: 'tournament_wins', count: 1 }
            },
            {
                key: 'tournament_champion',
                name: 'Чемпион турниров',
                description: 'Победить в 5 турнирах',
                icon: '👑',
                category: 'tournaments',
                rarity: 'rare',
                points: 100,
                requirements: { type: 'tournament_wins', count: 5 }
            },
            {
                key: 'tournament_legend',
                name: 'Легенда турниров',
                description: 'Победить в 10 турнирах',
                icon: '⭐',
                category: 'tournaments',
                rarity: 'legendary',
                points: 250,
                requirements: { type: 'tournament_wins', count: 10 }
            },

            // Достижения по играм
            {
                key: 'cs_specialist',
                name: 'Специалист CS',
                description: 'Участие в 10 турнирах по CS',
                icon: '🔫',
                category: 'games',
                rarity: 'uncommon',
                points: 30,
                requirements: { type: 'game_tournaments', game: 'CS:GO', count: 10 }
            },
            {
                key: 'dota_master',
                name: 'Мастер Dota',
                description: 'Участие в 10 турнирах по Dota 2',
                icon: '⚔️',
                category: 'games',
                rarity: 'uncommon',
                points: 30,
                requirements: { type: 'game_tournaments', game: 'Dota 2', count: 10 }
            },

            // Социальные достижения
            {
                key: 'social_butterfly',
                name: 'Душа компании',
                description: 'Добавить 10 друзей',
                icon: '👥',
                category: 'social',
                rarity: 'common',
                points: 15,
                requirements: { type: 'friends_count', count: 10 }
            },

            // Стрик достижения
            {
                key: 'win_streak_3',
                name: 'Тройная серия',
                description: 'Выиграть 3 турнира подряд',
                icon: '🔥',
                category: 'streaks',
                rarity: 'rare',
                points: 75,
                requirements: { type: 'win_streak', count: 3 }
            },
            {
                key: 'perfect_score',
                name: 'Идеальный счет',
                description: 'Завершить турнир без поражений',
                icon: '💎',
                category: 'performance',
                rarity: 'epic',
                points: 150,
                requirements: { type: 'perfect_tournament', count: 1 }
            },

            // Особые достижения
            {
                key: 'early_adopter',
                name: 'Пионер',
                description: 'Один из первых 100 пользователей',
                icon: '🚀',
                category: 'special',
                rarity: 'legendary',
                points: 500,
                requirements: { type: 'user_id_under', count: 100 }
            },
            {
                key: 'veteran',
                name: 'Ветеран',
                description: 'Участие в турнирах более года',
                icon: '🎖️',
                category: 'special',
                rarity: 'epic',
                points: 200,
                requirements: { type: 'account_age_days', count: 365 }
            }
        ];

        // Сохраняем достижения в базу (INSERT OR UPDATE)
        for (const achievement of baseAchievements) {
            await pool.query(`
                INSERT INTO achievements (key, name, description, icon, category, rarity, points, requirements)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (key) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    icon = EXCLUDED.icon,
                    category = EXCLUDED.category,
                    rarity = EXCLUDED.rarity,
                    points = EXCLUDED.points,
                    requirements = EXCLUDED.requirements
            `, [
                achievement.key,
                achievement.name,
                achievement.description,
                achievement.icon,
                achievement.category,
                achievement.rarity,
                achievement.points,
                JSON.stringify(achievement.requirements)
            ]);

            // Кэшируем достижение в памяти
            this.achievements.set(achievement.key, achievement);
        }

        console.log(`✅ Инициализировано ${baseAchievements.length} базовых достижений`);
    }

    async checkUserAchievements(userId) {
        if (!this.initialized) return [];

        try {
            const unlockedAchievements = [];
            
            // Получаем статистику пользователя
            const userStats = await this.getUserStats(userId);
            
            // Проверяем каждое достижение
            for (const [key, achievement] of this.achievements) {
                const isUnlocked = await this.checkAchievementProgress(userId, achievement, userStats);
                if (isUnlocked) {
                    unlockedAchievements.push({
                        key: achievement.key,
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        rarity: achievement.rarity,
                        points: achievement.points
                    });
                }
            }

            return unlockedAchievements;
        } catch (error) {
            console.error('❌ Ошибка проверки достижений пользователя:', error);
            return [];
        }
    }

    async checkAchievementProgress(userId, achievement, userStats) {
        const { requirements } = achievement;
        
        try {
            // Проверяем, не разблокировано ли уже это достижение
            const existingResult = await pool.query(
                'SELECT unlocked_at FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
                [userId, achievement.id]
            );
            
            if (existingResult.rows.length > 0 && existingResult.rows[0].unlocked_at) {
                return false; // Уже разблокировано
            }

            let progress = 0;
            let maxProgress = requirements.count || 1;
            let isCompleted = false;

            // Различные типы требований
            switch (requirements.type) {
                case 'tournament_participation':
                    progress = userStats.totalTournaments;
                    isCompleted = progress >= requirements.count;
                    break;

                case 'tournament_wins':
                    progress = userStats.winningTournaments;
                    isCompleted = progress >= requirements.count;
                    break;

                case 'game_tournaments':
                    progress = userStats.gameParticipation[requirements.game] || 0;
                    isCompleted = progress >= requirements.count;
                    break;

                case 'friends_count':
                    progress = await this.getFriendsCount(userId);
                    isCompleted = progress >= requirements.count;
                    break;

                case 'win_streak':
                    progress = await this.getWinStreak(userId);
                    isCompleted = progress >= requirements.count;
                    break;

                case 'perfect_tournament':
                    progress = await this.getPerfectTournaments(userId);
                    isCompleted = progress >= requirements.count;
                    break;

                case 'user_id_under':
                    progress = userId;
                    maxProgress = requirements.count;
                    isCompleted = userId <= requirements.count;
                    break;

                case 'account_age_days':
                    progress = await this.getAccountAgeDays(userId);
                    isCompleted = progress >= requirements.count;
                    break;

                default:
                    console.log(`❓ Неизвестный тип требования: ${requirements.type}`);
                    return false;
            }

            // Обновляем прогресс в базе данных
            await pool.query(`
                INSERT INTO user_achievements (user_id, achievement_id, progress, max_progress, unlocked_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, achievement_id) DO UPDATE SET
                    progress = EXCLUDED.progress,
                    max_progress = EXCLUDED.max_progress,
                    unlocked_at = CASE 
                        WHEN user_achievements.unlocked_at IS NULL AND $5 IS NOT NULL 
                        THEN EXCLUDED.unlocked_at 
                        ELSE user_achievements.unlocked_at 
                    END
            `, [userId, achievement.id, progress, maxProgress, isCompleted ? new Date() : null]);

            return isCompleted && !existingResult.rows[0]?.unlocked_at;
            
        } catch (error) {
            console.error(`❌ Ошибка проверки прогресса достижения ${achievement.key}:`, error);
            return false;
        }
    }

    async getUserStats(userId) {
        try {
            // Получаем статистику турниров
            const tournamentStats = await pool.query(`
                SELECT t.game, uts.result, uts.wins, uts.losses, uts.is_team
                FROM user_tournament_stats uts 
                JOIN tournaments t ON uts.tournament_id = t.id 
                WHERE uts.user_id = $1
            `, [userId]);

            const tournaments = tournamentStats.rows;
            const winningTournaments = tournaments.filter(t => t.result?.includes('Победитель')).length;
            
            // Подсчет участий по играм
            const gameParticipation = {};
            tournaments.forEach(t => {
                gameParticipation[t.game] = (gameParticipation[t.game] || 0) + 1;
            });

            return {
                totalTournaments: tournaments.length,
                winningTournaments,
                gameParticipation
            };
        } catch (error) {
            console.error('❌ Ошибка получения статистики пользователя для достижений:', error);
            return {
                totalTournaments: 0,
                winningTournaments: 0,
                gameParticipation: {}
            };
        }
    }

    async getFriendsCount(userId) {
        try {
            const result = await pool.query(
                'SELECT COUNT(*) FROM friends WHERE (user_id = $1 OR friend_id = $1) AND status = $2',
                [userId, 'accepted']
            );
            return parseInt(result.rows[0].count);
        } catch (error) {
            return 0;
        }
    }

    async getWinStreak(userId) {
        try {
            // Получаем последние результаты турниров в хронологическом порядке
            const results = await pool.query(`
                SELECT uts.result 
                FROM user_tournament_stats uts 
                JOIN tournaments t ON uts.tournament_id = t.id 
                WHERE uts.user_id = $1 AND t.status = 'completed'
                ORDER BY uts.updated_at DESC
                LIMIT 10
            `, [userId]);

            let streak = 0;
            for (const result of results.rows) {
                if (result.result?.includes('Победитель')) {
                    streak++;
                } else {
                    break;
                }
            }

            return streak;
        } catch (error) {
            return 0;
        }
    }

    async getPerfectTournaments(userId) {
        try {
            // Подсчитываем турниры где пользователь выиграл все матчи (losses = 0)
            const result = await pool.query(`
                SELECT COUNT(*) 
                FROM user_tournament_stats uts 
                WHERE uts.user_id = $1 AND uts.losses = 0 AND uts.wins > 0
            `, [userId]);
            
            return parseInt(result.rows[0].count);
        } catch (error) {
            return 0;
        }
    }

    async getAccountAgeDays(userId) {
        try {
            const result = await pool.query(
                'SELECT EXTRACT(epoch FROM NOW() - created_at) / 86400 as age_days FROM users WHERE id = $1',
                [userId]
            );
            
            return Math.floor(parseFloat(result.rows[0].age_days));
        } catch (error) {
            return 0;
        }
    }

    async getUserAchievements(userId) {
        try {
            const result = await pool.query(`
                SELECT 
                    a.id, a.name, a.description, a.icon, a.category, a.rarity, a.points,
                    ua.progress, ua.max_progress, ua.unlocked_at
                FROM achievements a
                LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
                ORDER BY 
                    CASE WHEN ua.unlocked_at IS NOT NULL THEN 0 ELSE 1 END,
                    a.rarity DESC, a.points DESC
            `, [userId]);

            const achievements = result.rows.map(row => ({
                key: row.id,
                name: row.name,
                description: row.description,
                icon: row.icon,
                category: row.category,
                rarity: row.rarity,
                points: row.points,
                progress: row.progress || 0,
                maxProgress: row.max_progress || 1,
                isUnlocked: !!row.unlocked_at,
                unlockedAt: row.unlocked_at,
                progressPercentage: row.max_progress > 0 ? Math.round((row.progress || 0) / row.max_progress * 100) : 0
            }));

            // Подсчитываем общие очки
            const totalPoints = achievements
                .filter(a => a.isUnlocked)
                .reduce((sum, a) => sum + a.points, 0);

            return {
                achievements,
                totalPoints,
                unlockedCount: achievements.filter(a => a.isUnlocked).length,
                totalCount: achievements.length
            };
        } catch (error) {
            console.error('❌ Ошибка получения достижений пользователя:', error);
            return {
                achievements: [],
                totalPoints: 0,
                unlockedCount: 0,
                totalCount: 0
            };
        }
    }

    async getUserRanking(userId) {
        try {
            // Получаем рейтинг пользователя по очкам достижений
            const result = await pool.query(`
                WITH user_points AS (
                    SELECT 
                        ua.user_id,
                        u.username,
                        COALESCE(SUM(a.points), 0) as total_points
                    FROM users u
                    LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.unlocked_at IS NOT NULL
                    LEFT JOIN achievements a ON ua.achievement_id = a.id
                    GROUP BY ua.user_id, u.username
                ),
                ranked_users AS (
                    SELECT 
                        user_id, username, total_points,
                        ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
                    FROM user_points
                    WHERE total_points > 0
                )
                SELECT rank, total_points 
                FROM ranked_users 
                WHERE user_id = $1
            `, [userId]);

            if (result.rows.length > 0) {
                return {
                    rank: result.rows[0].rank,
                    points: result.rows[0].total_points
                };
            }

            return { rank: null, points: 0 };
        } catch (error) {
            console.error('❌ Ошибка получения рейтинга пользователя:', error);
            return { rank: null, points: 0 };
        }
    }

    async getLeaderboard(limit = 10) {
        try {
            const result = await pool.query(`
                WITH user_points AS (
                    SELECT 
                        ua.user_id,
                        u.username,
                        u.avatar_url,
                        COALESCE(SUM(a.points), 0) as total_points,
                        COUNT(CASE WHEN ua.unlocked_at IS NOT NULL THEN 1 END) as unlocked_count
                    FROM users u
                    LEFT JOIN user_achievements ua ON u.id = ua.user_id
                    LEFT JOIN achievements a ON ua.achievement_id = a.id AND ua.unlocked_at IS NOT NULL
                    GROUP BY ua.user_id, u.username, u.avatar_url
                )
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank,
                    user_id, username, avatar_url, total_points, unlocked_count
                FROM user_points
                WHERE total_points > 0
                ORDER BY total_points DESC
                LIMIT $1
            `, [limit]);

            return result.rows.map(row => ({
                rank: row.rank,
                userId: row.user_id,
                username: row.username,
                avatarUrl: row.avatar_url,
                points: row.total_points,
                unlockedCount: row.unlocked_count
            }));
        } catch (error) {
            console.error('❌ Ошибка получения лидерборда:', error);
            return [];
        }
    }

    // Метод для принудительной проверки достижений (например, после завершения турнира)
    async triggerAchievementCheck(userId, eventType, eventData = {}) {
        if (!this.initialized) return [];

        try {
            console.log(`🎯 Проверка достижений для пользователя ${userId} после события ${eventType}`);
            const newlyUnlocked = await this.checkUserAchievements(userId);
            
            if (newlyUnlocked.length > 0) {
                console.log(`🏆 Разблокировано ${newlyUnlocked.length} новых достижений для пользователя ${userId}`);
                
                // Можно добавить уведомления или другую логику
                return newlyUnlocked;
            }

            return [];
        } catch (error) {
            console.error('❌ Ошибка принудительной проверки достижений:', error);
            return [];
        }
    }
}

module.exports = new AchievementSystem(); 