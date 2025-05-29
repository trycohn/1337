const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Функция для создания slug из названия
function createSlug(name) {
    return name.toLowerCase()
        .replace(/[^a-z0-9а-я]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Получение списка всех организаторов (публичный эндпоинт)
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const result = await pool.query(`
            SELECT o.*, 
                   u.username as manager_username,
                   u.avatar_url as manager_avatar,
                   COUNT(DISTINCT om.user_id) as members_count,
                   COUNT(DISTINCT to2.tournament_id) as tournaments_count
            FROM organizers o
            LEFT JOIN users u ON o.manager_user_id = u.id
            LEFT JOIN organizer_members om ON o.id = om.organizer_id
            LEFT JOIN tournament_organizers to2 ON o.id = to2.organizer_id
            WHERE o.is_active = true
            GROUP BY o.id, u.username, u.avatar_url
            ORDER BY o.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // Получаем общее количество организаторов
        const countResult = await pool.query('SELECT COUNT(*) FROM organizers WHERE is_active = true');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            organizers: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Ошибка получения списка организаторов:', err);
        res.status(500).json({ error: 'Не удалось получить список организаторов' });
    }
});

// Получение профиля организатора по slug (публичный эндпоинт)
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        // Получаем основную информацию об организаторе
        const organizerResult = await pool.query(`
            SELECT o.*, 
                   u.username as manager_username,
                   u.avatar_url as manager_avatar,
                   u.id as manager_id
            FROM organizers o
            LEFT JOIN users u ON o.manager_user_id = u.id
            WHERE o.slug = $1 AND o.is_active = true
        `, [slug]);

        if (organizerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Организатор не найден' });
        }

        const organizer = organizerResult.rows[0];

        // Получаем участников организации
        const membersResult = await pool.query(`
            SELECT om.role, om.joined_at,
                   u.id, u.username, u.avatar_url
            FROM organizer_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.organizer_id = $1
            ORDER BY 
                CASE om.role 
                    WHEN 'manager' THEN 1 
                    WHEN 'admin' THEN 2 
                    ELSE 3 
                END,
                om.joined_at ASC
        `, [organizer.id]);

        // Получаем турниры организатора с информацией о победителях
        const tournamentsResult = await pool.query(`
            SELECT t.id, t.name, t.status, t.start_date, t.end_date, 
                   COALESCE(t.max_participants, 0) as max_teams, 
                   (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id) as current_teams,
                   COALESCE(t.prize_pool, 'Не указан') as prize_pool, t.game as discipline,
                   NULL as winner
            FROM tournaments t
            JOIN tournament_organizers to2 ON t.id = to2.tournament_id
            WHERE to2.organizer_id = $1
            ORDER BY t.start_date DESC
        `, [organizer.id]);

        // Статистика
        const statsResult = await pool.query(`
            SELECT 
                COUNT(DISTINCT to2.tournament_id) as total_tournaments,
                COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN to2.tournament_id END) as completed_tournaments,
                COUNT(DISTINCT CASE WHEN t.status = 'active' THEN to2.tournament_id END) as active_tournaments,
                COUNT(DISTINCT om.user_id) as total_members,
                0 as total_prize_pool
            FROM organizers o
            LEFT JOIN tournament_organizers to2 ON o.id = to2.organizer_id
            LEFT JOIN tournaments t ON to2.tournament_id = t.id
            LEFT JOIN organizer_members om ON o.id = om.organizer_id
            WHERE o.id = $1
            GROUP BY o.id
        `, [organizer.id]);

        const stats = statsResult.rows[0] || {
            total_tournaments: 0,
            completed_tournaments: 0,
            active_tournaments: 0,
            total_members: 0,
            total_prize_pool: 0
        };

        res.json({
            organizer,
            members: membersResult.rows,
            tournaments: tournamentsResult.rows,
            stats
        });

    } catch (err) {
        console.error('Ошибка получения профиля организатора:', err);
        res.status(500).json({ error: 'Не удалось получить профиль организатора' });
    }
});

// Получение организаций пользователя (требует авторизации)
router.get('/user/my-organizations', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, om.role, om.joined_at,
                   COUNT(DISTINCT to2.tournament_id) as tournaments_count
            FROM organizer_members om
            JOIN organizers o ON om.organizer_id = o.id
            LEFT JOIN tournament_organizers to2 ON o.id = to2.organizer_id
            WHERE om.user_id = $1 AND o.is_active = true
            GROUP BY o.id, om.role, om.joined_at
            ORDER BY om.joined_at DESC
        `, [req.user.id]);

        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения организаций пользователя:', err);
        res.status(500).json({ error: 'Не удалось получить организации пользователя' });
    }
});

// Создание организатора (только для администраторов)
router.post('/', authenticateToken, async (req, res) => {
    const { 
        name, 
        description, 
        logo_url, 
        website_url, 
        vk_url, 
        telegram_url, 
        contact_email, 
        contact_phone, 
        manager_user_id 
    } = req.body;

    // Проверяем права доступа (только администраторы могут создавать организаторов)
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Недостаточно прав для создания организатора' });
    }

    if (!name || !manager_user_id) {
        return res.status(400).json({ error: 'Название и менеджер обязательны' });
    }

    try {
        // Создаем slug из названия
        let slug = createSlug(name);
        
        // Проверяем уникальность slug
        let slugCounter = 1;
        let originalSlug = slug;
        while (true) {
            const existingSlug = await pool.query('SELECT id FROM organizers WHERE slug = $1', [slug]);
            if (existingSlug.rows.length === 0) break;
            slug = `${originalSlug}-${slugCounter}`;
            slugCounter++;
        }

        // Проверяем, что менеджер существует
        const managerResult = await pool.query('SELECT id FROM users WHERE id = $1', [manager_user_id]);
        if (managerResult.rows.length === 0) {
            return res.status(400).json({ error: 'Указанный менеджер не найден' });
        }

        // Создаем организатора
        const result = await pool.query(`
            INSERT INTO organizers (
                name, slug, description, logo_url, website_url, 
                vk_url, telegram_url, contact_email, contact_phone, manager_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [name, slug, description, logo_url, website_url, vk_url, telegram_url, contact_email, contact_phone, manager_user_id]);

        const organizer = result.rows[0];

        // Добавляем менеджера как участника с ролью 'manager'
        await pool.query(`
            INSERT INTO organizer_members (organizer_id, user_id, role)
            VALUES ($1, $2, 'manager')
        `, [organizer.id, manager_user_id]);

        res.status(201).json({
            message: 'Организатор успешно создан',
            organizer
        });

    } catch (err) {
        console.error('Ошибка создания организатора:', err);
        res.status(500).json({ error: 'Не удалось создать организатора' });
    }
});

// Обновление организатора (только менеджер или администратор)
router.put('/:slug', authenticateToken, async (req, res) => {
    const { slug } = req.params;
    const { 
        name, 
        description, 
        logo_url, 
        website_url, 
        vk_url, 
        telegram_url, 
        contact_email, 
        contact_phone 
    } = req.body;

    try {
        // Получаем организатора
        const organizerResult = await pool.query('SELECT * FROM organizers WHERE slug = $1', [slug]);
        if (organizerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Организатор не найден' });
        }

        const organizer = organizerResult.rows[0];

        // Проверяем права доступа
        if (req.user.role !== 'admin' && organizer.manager_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Недостаточно прав для редактирования организатора' });
        }

        // Обновляем организатора
        const result = await pool.query(`
            UPDATE organizers 
            SET name = $1, description = $2, logo_url = $3, website_url = $4,
                vk_url = $5, telegram_url = $6, contact_email = $7, contact_phone = $8
            WHERE id = $9
            RETURNING *
        `, [name, description, logo_url, website_url, vk_url, telegram_url, contact_email, contact_phone, organizer.id]);

        res.json({
            message: 'Организатор успешно обновлен',
            organizer: result.rows[0]
        });

    } catch (err) {
        console.error('Ошибка обновления организатора:', err);
        res.status(500).json({ error: 'Не удалось обновить организатора' });
    }
});

// Добавление участника в организацию (только менеджер или администратор)
router.post('/:slug/members', authenticateToken, async (req, res) => {
    const { slug } = req.params;
    const { user_id, role = 'member' } = req.body;

    try {
        // Получаем организатора
        const organizerResult = await pool.query('SELECT * FROM organizers WHERE slug = $1', [slug]);
        if (organizerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Организатор не найден' });
        }

        const organizer = organizerResult.rows[0];

        // Проверяем права доступа
        if (req.user.role !== 'admin' && organizer.manager_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Недостаточно прав для добавления участников' });
        }

        // Проверяем, что пользователь существует
        const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        // Добавляем участника
        await pool.query(`
            INSERT INTO organizer_members (organizer_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (organizer_id, user_id) 
            DO UPDATE SET role = $3
        `, [organizer.id, user_id, role]);

        res.json({ message: 'Участник успешно добавлен' });

    } catch (err) {
        console.error('Ошибка добавления участника:', err);
        res.status(500).json({ error: 'Не удалось добавить участника' });
    }
});

// Удаление участника из организации (только менеджер или администратор)
router.delete('/:slug/members/:userId', authenticateToken, async (req, res) => {
    const { slug, userId } = req.params;

    try {
        // Получаем организатора
        const organizerResult = await pool.query('SELECT * FROM organizers WHERE slug = $1', [slug]);
        if (organizerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Организатор не найден' });
        }

        const organizer = organizerResult.rows[0];

        // Проверяем права доступа
        if (req.user.role !== 'admin' && organizer.manager_user_id !== req.user.id) {
            return res.status(403).json({ error: 'Недостаточно прав для удаления участников' });
        }

        // Нельзя удалить менеджера
        if (parseInt(userId) === organizer.manager_user_id) {
            return res.status(400).json({ error: 'Нельзя удалить менеджера организации' });
        }

        // Удаляем участника
        await pool.query(`
            DELETE FROM organizer_members 
            WHERE organizer_id = $1 AND user_id = $2
        `, [organizer.id, userId]);

        res.json({ message: 'Участник успешно удален' });

    } catch (err) {
        console.error('Ошибка удаления участника:', err);
        res.status(500).json({ error: 'Не удалось удалить участника' });
    }
});

module.exports = router; 