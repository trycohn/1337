/**
 * 🔗 СИСТЕМА РЕФЕРАЛЬНЫХ ПРИГЛАШЕНИЙ v1.0.0
 * 
 * @version 1.0.0
 * @updated 2025-01-25
 * @author 1337 Community Development Team
 * @purpose API для генерации и обработки реферальных ссылок
 * @features Генерация ссылок, регистрация по ссылкам, статистика
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// 🔗 Генерация реферальной ссылки для турнира
router.post('/generate-link', authenticateToken, async (req, res) => {
    const { tournament_id } = req.body;
    const user_id = req.user.id;

    if (!tournament_id) {
        return res.status(400).json({ 
            success: false, 
            message: 'ID турнира обязателен' 
        });
    }

    try {
        // Проверяем существование турнира
        const tournamentCheck = await pool.query(
            'SELECT id, name, status FROM tournaments WHERE id = $1',
            [tournament_id]
        );

        if (tournamentCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Турнир не найден' 
            });
        }

        const tournament = tournamentCheck.rows[0];

        // Проверяем, что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ 
                success: false, 
                message: 'Реферальные ссылки можно создавать только для активных турниров' 
            });
        }

        // Проверяем, есть ли уже активная ссылка для этого турнира от данного пользователя
        const existingLink = await pool.query(`
            SELECT * FROM referral_links 
            WHERE user_id = $1 AND tournament_id = $2 
            AND expires_at > NOW()
            AND (is_active = true OR is_active IS NULL)
        `, [user_id, tournament_id]);

        if (existingLink.rows.length > 0) {
            // Возвращаем существующую ссылку
            const link = existingLink.rows[0];
            const baseUrl = process.env.CLIENT_URL || 
                           (process.env.NODE_ENV === 'production' ? 'https://1337community.com' : 'http://localhost:3000');
            
            return res.json({
                success: true,
                message: 'Реферальная ссылка уже существует',
                data: {
                    ...link,
                    full_url: `${baseUrl}/invite/${link.referral_code}`
                }
            });
        }

        // Генерируем уникальный код
        const referralCode = crypto.randomBytes(8).toString('hex').toUpperCase();
        
        // Создаем реферальную ссылку
        const result = await pool.query(`
            INSERT INTO referral_links (
                user_id, tournament_id, referral_code, 
                expires_at, max_uses, uses_count
            ) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 10, 0)
            RETURNING *
        `, [user_id, tournament_id, referralCode]);

        const referralLink = result.rows[0];
        
        // Формируем полную ссылку
        const baseUrl = process.env.CLIENT_URL || 
                       (process.env.NODE_ENV === 'production' ? 'https://1337community.com' : 'http://localhost:3000');
        
        const fullUrl = `${baseUrl}/invite/${referralCode}`;

        console.log(`✅ Реферальная ссылка создана: ${fullUrl} для пользователя ${req.user.username}`);

        res.json({
            success: true,
            message: 'Реферальная ссылка успешно создана',
            data: {
                ...referralLink,
                full_url: fullUrl
            }
        });

    } catch (error) {
        console.error('❌ Ошибка создания реферальной ссылки:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при создании ссылки' 
        });
    }
});

// 📊 Получение информации о реферальной ссылке (для страницы приглашения)
router.get('/info/:referralCode', async (req, res) => {
    const { referralCode } = req.params;

    if (!referralCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Реферальный код обязателен' 
        });
    }

    try {
        // Получаем информацию о реферальной ссылке с данными о турнире и пользователе
        const result = await pool.query(`
            SELECT 
                rl.*,
                u.username as referrer_username,
                t.id as tournament_id,
                t.name as tournament_name,
                t.game as tournament_game,
                t.format as tournament_format,
                t.status as tournament_status,
                t.max_participants as tournament_max_participants,
                (SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id) as tournament_participants_count
            FROM referral_links rl
            LEFT JOIN users u ON rl.user_id = u.id
            LEFT JOIN tournaments t ON rl.tournament_id = t.id
            WHERE rl.referral_code = $1 
              AND rl.expires_at > NOW()
              AND rl.uses_count < rl.max_uses
        `, [referralCode]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Реферальная ссылка не найдена, истекла или исчерпана' 
            });
        }

        const linkData = result.rows[0];
        
        // Формируем ответ
        const responseData = {
            id: linkData.id,
            referral_code: linkData.referral_code,
            user_id: linkData.user_id,
            referrer_username: linkData.referrer_username,
            expires_at: linkData.expires_at,
            max_uses: linkData.max_uses,
            uses_count: linkData.uses_count,
            created_at: linkData.created_at,
            tournament: linkData.tournament_id ? {
                id: linkData.tournament_id,
                name: linkData.tournament_name,
                game: linkData.tournament_game,
                format: linkData.tournament_format,
                status: linkData.tournament_status,
                max_participants: linkData.tournament_max_participants,
                participants_count: parseInt(linkData.tournament_participants_count)
            } : null
        };

        console.log(`📊 Информация о реферальной ссылке ${referralCode} предоставлена`);

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('❌ Ошибка получения информации о реферальной ссылке:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при получении информации о ссылке' 
        });
    }
});

// 📊 Получение статистики реферальных приглашений пользователя
router.get('/stats', authenticateToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        // Получаем общую статистику через функцию БД
        const statsResult = await pool.query(
            'SELECT * FROM get_user_referral_stats($1)',
            [user_id]
        );

        const stats = statsResult.rows[0] || {
            total_invitations: 0,
            successful_registrations: 0,
            tournament_participants: 0,
            active_links: 0
        };

        // Получаем детальную информацию о последних приглашениях
        const recentLinksResult = await pool.query(
            `SELECT rl.id, rl.referral_code, rl.expires_at, rl.uses_count, rl.max_uses, 
                    t.name as tournament_name, t.id as tournament_id,
                    rl.created_at
             FROM referral_links rl
             JOIN tournaments t ON rl.tournament_id = t.id
             WHERE rl.user_id = $1 
             ORDER BY rl.created_at DESC 
             LIMIT 10`,
            [user_id]
        );

        // Получаем информацию о успешных приглашениях
        const successfulInvitesResult = await pool.query(
            `SELECT rr.registered_at, rr.participated_in_tournament,
                    u.username as invited_user_name,
                    t.name as tournament_name, t.id as tournament_id
             FROM referral_registrations rr
             JOIN users u ON rr.referred_user_id = u.id
             JOIN tournaments t ON rr.tournament_id = t.id
             WHERE rr.referrer_id = $1 
             ORDER BY rr.registered_at DESC 
             LIMIT 10`,
            [user_id]
        );

        res.json({
            success: true,
            data: {
                summary: stats,
                recent_links: recentLinksResult.rows,
                successful_invites: successfulInvitesResult.rows
            }
        });

    } catch (error) {
        console.error('❌ [getStats] Ошибка получения статистики:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка получения статистики' 
        });
    }
});

// 📈 Получение статистики приглашений пользователя
router.get('/stats', authenticateToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        // Получаем общую статистику приглашений
        const statsResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT rl.id) as total_invitations,
                COUNT(DISTINCT ru.new_user_id) as successful_registrations,
                COUNT(DISTINCT CASE WHEN tp.user_id IS NOT NULL THEN ru.new_user_id END) as tournament_participants,
                COUNT(DISTINCT CASE WHEN rl.is_active = true AND rl.expires_at > NOW() THEN rl.id END) as active_links
            FROM referral_links rl
            LEFT JOIN referral_uses ru ON rl.id = ru.referral_link_id
            LEFT JOIN tournament_participants tp ON ru.new_user_id = tp.user_id AND rl.tournament_id = tp.tournament_id
            WHERE rl.user_id = $1
        `, [user_id]);

        // Получаем детальную информацию о последних приглашениях
        const recentResult = await pool.query(`
            SELECT 
                rl.referral_code,
                rl.created_at,
                rl.expires_at,
                rl.uses_count,
                rl.max_uses,
                t.name as tournament_name,
                ARRAY_AGG(u.username) FILTER (WHERE u.username IS NOT NULL) as invited_users
            FROM referral_links rl
            LEFT JOIN tournaments t ON rl.tournament_id = t.id
            LEFT JOIN referral_uses ru ON rl.id = ru.referral_link_id
            LEFT JOIN users u ON ru.new_user_id = u.id
            WHERE rl.user_id = $1
            GROUP BY rl.id, rl.referral_code, rl.created_at, rl.expires_at, rl.uses_count, rl.max_uses, t.name
            ORDER BY rl.created_at DESC
            LIMIT 10
        `, [user_id]);

        const stats = statsResult.rows[0];
        const recentInvitations = recentResult.rows;

        console.log(`📈 Статистика приглашений для пользователя ${req.user.username} предоставлена`);

        res.json({
            success: true,
            data: {
                summary: {
                    total_invitations: parseInt(stats.total_invitations),
                    successful_registrations: parseInt(stats.successful_registrations),
                    tournament_participants: parseInt(stats.tournament_participants),
                    active_links: parseInt(stats.active_links)
                },
                recent_invitations: recentInvitations
            }
        });

    } catch (error) {
        console.error('❌ Ошибка получения статистики приглашений:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера при получении статистики' 
        });
    }
});

// 🔍 Проверка реферальной ссылки (для валидации на frontend)
router.get('/validate/:referralCode', async (req, res) => {
    const { referralCode } = req.params;

    if (!referralCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Реферальный код не указан' 
        });
    }

    try {
        const linkResult = await pool.query(
            `SELECT rl.id, rl.user_id, rl.tournament_id, rl.expires_at, rl.uses_count, rl.max_uses,
                    t.name as tournament_name, t.status as tournament_status,
                    u.username as inviter_name
             FROM referral_links rl
             JOIN tournaments t ON rl.tournament_id = t.id
             JOIN users u ON rl.user_id = u.id
             WHERE rl.referral_code = $1`,
            [referralCode]
        );

        if (linkResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Реферальная ссылка не найдена' 
            });
        }

        const link = linkResult.rows[0];

        // Проверяем актуальность ссылки
        const isExpired = new Date(link.expires_at) < new Date();
        const isMaxUsesReached = link.uses_count >= link.max_uses;
        const isTournamentActive = link.tournament_status === 'active';

        res.json({
            success: true,
            data: {
                is_valid: !isExpired && !isMaxUsesReached && isTournamentActive,
                tournament: {
                    id: link.tournament_id,
                    name: link.tournament_name,
                    status: link.tournament_status
                },
                inviter: {
                    id: link.user_id,
                    username: link.inviter_name
                },
                link_info: {
                    expires_at: link.expires_at,
                    is_expired: isExpired,
                    uses_count: link.uses_count,
                    max_uses: link.max_uses,
                    is_max_uses_reached: isMaxUsesReached
                }
            }
        });

    } catch (error) {
        console.error('❌ [validateLink] Ошибка валидации реферальной ссылки:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка валидации реферральной ссылки' 
        });
    }
});

// 📝 Обработка регистрации по реферальной ссылке (вызывается при регистрации)
router.post('/register-referral', async (req, res) => {
    const { referral_code, new_user_id } = req.body;

    if (!referral_code || !new_user_id) {
        return res.status(400).json({ 
            success: false, 
            message: 'Реферальный код и ID пользователя обязательны' 
        });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Находим реферальную ссылку
        const linkResult = await client.query(
            `SELECT rl.id, rl.user_id as referrer_id, rl.tournament_id, rl.expires_at, rl.uses_count, rl.max_uses
             FROM referral_links rl
             WHERE rl.referral_code = $1`,
            [referral_code]
        );

        if (linkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                message: 'Реферальная ссылка не найдена' 
            });
        }

        const link = linkResult.rows[0];

        // Проверяем актуальность ссылки
        const isExpired = new Date(link.expires_at) < new Date();
        const isMaxUsesReached = link.uses_count >= link.max_uses;

        if (isExpired || isMaxUsesReached) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'Реферальная ссылка истекла или исчерпана' 
            });
        }

        // Обновляем информацию о пользователе (кто его пригласил)
        await client.query(
            'UPDATE users SET invited_by = $1, invited_at = NOW() WHERE id = $2',
            [link.referrer_id, new_user_id]
        );

        // Увеличиваем счетчик использований ссылки
        await client.query(
            'UPDATE referral_links SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = $1',
            [link.id]
        );

        // Записываем факт успешного приглашения
        await client.query(
            `INSERT INTO referral_registrations (referrer_id, referred_user_id, tournament_id, referral_link_id)
             VALUES ($1, $2, $3, $4)`,
            [link.referrer_id, new_user_id, link.tournament_id, link.id]
        );

        await client.query('COMMIT');

        console.log(`✅ [registerReferral] Пользователь ${new_user_id} зарегистрирован по реферальной ссылке от ${link.referrer_id}`);

        res.json({
            success: true,
            message: 'Приглашение успешно обработано',
            data: {
                referrer_id: link.referrer_id,
                tournament_id: link.tournament_id
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [registerReferral] Ошибка обработки приглашения:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка обработки приглашения' 
        });
    } finally {
        client.release();
    }
});

// 🧹 Очистка устаревших ссылок (админский endpoint)
router.post('/cleanup-expired', authenticateToken, async (req, res) => {
    // Проверяем права администратора
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Недостаточно прав' 
        });
    }

    try {
        const result = await pool.query('SELECT cleanup_expired_referral_links()');
        const deletedCount = result.rows[0].cleanup_expired_referral_links;

        res.json({
            success: true,
            message: `Удалено ${deletedCount} устаревших реферальных ссылок`,
            deleted_count: deletedCount
        });

    } catch (error) {
        console.error('❌ [cleanupExpired] Ошибка очистки:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка очистки устаревших ссылок' 
        });
    }
});

module.exports = router; 